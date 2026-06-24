import { RoutePath, SafetyAnalysisResult, ProximityThreat } from "../types";

/**
 * Calculates the perpendicular distance in meters from point P to line segment AB.
 */
export const getMinDistanceToSegment = (
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number
): number => {
  // Flat earth projection in meters around San Francisco
  const latRatio = 111000;
  const lngRatio = 88000;

  const py = pLat * latRatio;
  const px = pLng * lngRatio;
  const ay = aLat * latRatio;
  const ax = aLng * lngRatio;
  const by = bLat * latRatio;
  const bx = bLng * lngRatio;

  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) {
    return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t)); // Clamp to segment length

  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
};

/**
 * Evaluates the safety of a given route path against active and historical hazards.
 */
export const analyzeRouteSafety = (
  route: RoutePath,
  hazards: any[],
  maxBufferMeters: number = 1000 // 1 km buffer zone
): SafetyAnalysisResult => {
  const threats: ProximityThreat[] = [];
  const explanations: string[] = [];

  hazards.forEach((h) => {
    // Find the minimum distance from this hazard to any segment of the route
    let minDistance = Infinity;

    for (let i = 0; i < route.length - 1; i++) {
      const dist = getMinDistanceToSegment(
        h.location_lat,
        h.location_lng,
        route[i][0],
        route[i][1],
        route[i + 1][0],
        route[i + 1][1]
      );
      if (dist < minDistance) {
        minDistance = dist;
      }
    }

    // If within our buffer zone, evaluate threat level
    if (minDistance <= maxBufferMeters) {
      const isActive = h.status === "active";
      let basePoints = 0;

      switch (h.severity) {
        case "critical":
          basePoints = 45;
          break;
        case "high":
          basePoints = 30;
          break;
        case "medium":
          basePoints = 15;
          break;
        default:
          basePoints = 5;
          break;
      }

      // Linear distance decay: risk is maximum at 0m distance, and 0 at maxBufferMeters
      const distanceFactor = 1 - minDistance / maxBufferMeters;
      let riskPoints = basePoints * distanceFactor;

      // Historical (resolved) incidents have 80% lower weight
      if (!isActive) {
        riskPoints *= 0.2;
      }

      riskPoints = Math.round(riskPoints * 10) / 10; // Round to 1 decimal place

      if (riskPoints > 0) {
        threats.push({
          hazardId: h.id,
          title: h.title,
          category: h.category,
          severity: h.severity,
          distanceMeters: Math.round(minDistance),
          isActive,
          riskPoints,
        });

        const statusLabel = isActive ? "active" : "historical";
        explanations.push(
          `${h.severity.toUpperCase()} ${h.category} (${statusLabel}) detected ${Math.round(
            minDistance
          )}m from route (+${riskPoints} risk points)`
        );
      }
    }
  });

  // Calculate final scores
  const totalRiskPoints = threats.reduce((sum, t) => sum + t.riskPoints, 0);
  const safetyScore = Math.max(0, Math.min(100, Math.round(100 - totalRiskPoints)));
  const riskScore = 100 - safetyScore;

  return {
    safetyScore,
    riskScore,
    proximityThreats: threats.sort((a, b) => b.riskPoints - a.riskPoints),
    explanations,
  };
};

/**
 * Dynamically shifts midpoints of a route opposite to closest active high-severity threats.
 */
export const generateDetourRoute = (
  route: RoutePath,
  hazards: any[],
  maxBufferMeters: number = 800
): RoutePath => {
  const activeHighThreats = hazards.filter(
    (h) =>
      h.status === "active" &&
      (h.severity === "high" || h.severity === "critical")
  );

  if (activeHighThreats.length === 0) {
    return route;
  }

  // Degrees approximation (roughly 800m)
  const thresholdDeg = 0.008;

  return route.map((pt, idx) => {
    // Lock start and end coordinates
    if (idx === 0 || idx === route.length - 1) return pt;

    let lat = pt[0];
    let lng = pt[1];

    activeHighThreats.forEach((threat) => {
      const dy = lat - threat.location_lat;
      const dx = lng - threat.location_lng;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < thresholdDeg) {
        const len = dist || 1;
        // Shift point away from the threat center by 0.014 degrees (approx 1.5km detour)
        lat += (dy / len) * 0.014;
        lng += (dx / len) * 0.014;
      }
    });

    return [lat, lng];
  });
};
