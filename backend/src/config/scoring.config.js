/**
 * Safe Route App - Scoring Configuration
 * All scoring weights, radius distances, thresholds, and penalty rules.
 * Tunable for custom city profiles and safety criteria.
 */

export const scoringConfig = {
  // Segment splitting distance in meters
  segmentLengthMeters: 100,

  // 1. Open Places (Max 30 points)
  // Types: shop24, fuel, pharmacy, atm
  openPlaces: {
    maxPoints: 30,
    radiusMeters: 150,
    // Each open place contributes points up to the cap
    pointsPerPlace: 7.5,
    maxPlaceCountForCap: 4, // 4 * 7.5 = 30
    eligibleTypes: ['shop24', 'fuel', 'pharmacy', 'atm']
  },

  // 2. Activity / Road Profile (Max 30 points)
  // Combined road type importance + general place density
  activity: {
    maxPoints: 30,
    roadTypeMaxPoints: 18,
    densityMaxPoints: 12,
    densityRadiusMeters: 150,
    densityCap: 6, // 6 or more places nearby = full density points
    // ORS waytype mappings (waytype extra_info values)
    waytypeWeights: {
      1: 0.9,   // State Road / Primary
      2: 0.8,   // Secondary Road
      3: 0.7,   // Tertiary Road
      4: 0.5,   // Residential / Street
      5: 0.3,   // Living street
      6: 0.4,   // Pedestrian zone
      7: 0.3,   // Footway / Cycleway
      8: 0.2,   // Path
      9: 0.1,   // Track
      10: 0.05, // Service / alley
      default: 0.4
    }
  },

  // 3. Police Station Proximity (Max 20 points)
  police: {
    maxPoints: 20,
    fullPointsDistanceMeters: 500,
    zeroPointsDistanceMeters: 2000
  },

  // 4. Hospital Proximity (Max 10 points)
  hospital: {
    maxPoints: 10,
    fullPointsDistanceMeters: 1000,
    zeroPointsDistanceMeters: 3000
  },

  // 5. User Reports (Max +/- 10 points)
  reports: {
    maxPoints: 10,
    radiusMeters: 150,
    safeSpotPositiveScore: 5,     // Each approved or confirmed safe_spot report
    negativeReportPenalty: -4,    // Each confirmed negative report (harassment, dark, isolated, felt_unsafe)
    maxPositiveCap: 10,
    maxNegativeCap: -10,
    // Minimum independent hashed IPs required if report is pending
    minUnapprovedIpHashCount: 2
  },

  // 6. Penalties (Up to -15 points total)
  penalties: {
    maxTotalPenalty: -15,
    underpassOrTunnelPenalty: -10,
    deadEndPenalty: -8,
    isolatedStretchNoPlacesPenalty: -7, // If 0 places within 250m
    isolatedStretchRadiusMeters: 250
  },

  // Route Level Safety Thresholds
  routeLevels: {
    green: { min: 70, max: 100, label: 'green' },
    yellow: { min: 40, max: 69.99, label: 'yellow' },
    red: { min: 0, max: 39.99, label: 'red' },
    weakestSegmentPenaltyThreshold: 30,
    weakestSegmentDeduction: 10
  },

  disclaimer: "This is a suggestion based on available data, not a guarantee of safety. Scores do not consider lighting."
};
