import { WeatherMetrics, PredictionEngineResult, PredictionFactor } from "../types";
import { Hazard } from "../../hazards/types";

/**
 * Calculates Euclidean distance in meters between two coordinates.
 */
const getDistanceMeters = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const dy = (lat2 - lat1) * 111000;
  const dx = (lng2 - lng1) * 88000;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Combines weather metrics, location history, and density trends to predict probability scores.
 */
export const calculateHazardPredictions = (
  lat: number,
  lng: number,
  weather: WeatherMetrics,
  hazards: Hazard[]
): PredictionEngineResult => {
  // Filter hazards within 1500 meters of coordinates
  const localHazards = hazards.filter(
    (h) => getDistanceMeters(lat, lng, h.location_lat, h.location_lng) <= 1500
  );

  const activeLocal = localHazards.filter((h) => h.status === "active");
  const historicalLocal = localHazards.filter((h) => h.status === "resolved");

  // ==========================================
  // 1. FLOOD RISK
  // ==========================================
  let floodProb = 5;
  const floodExplanations: string[] = [];

  // Weather precipitation impact
  if (weather.precipitation24h > 0) {
    const rainScore = Math.min(45, weather.precipitation24h * 1.5);
    floodProb += rainScore;
    floodExplanations.push(
      `Upcoming rain forecast of ${weather.precipitation24h}mm (+${Math.round(
        rainScore
      )}% risk)`
    );
  }

  // WMO Storm codes impact (codes 51-67, 80-82, 95-99)
  if (weather.weatherCode >= 95) {
    floodProb += 25;
    floodExplanations.push("Thunderstorm forecast in progress (+25% risk)");
  } else if (weather.weatherCode >= 80 || (weather.weatherCode >= 61 && weather.weatherCode <= 65)) {
    floodProb += 15;
    floodExplanations.push("Heavy rain showers forecasted (+15% risk)");
  }

  // Active flood reports nearby
  const activeFloods = activeLocal.filter((h) => h.category === "flood").length;
  if (activeFloods > 0) {
    const activeScore = Math.min(40, activeFloods * 20);
    floodProb += activeScore;
    floodExplanations.push(
      `${activeFloods} active flood reports within 1.5km (+${activeScore}% risk)`
    );
  }

  // Historical flood reports nearby
  const pastFloods = historicalLocal.filter((h) => h.category === "flood").length;
  if (pastFloods > 0) {
    const pastScore = Math.min(20, pastFloods * 8);
    floodProb += pastScore;
    floodExplanations.push(
      `Area has historical flooding records (${pastFloods} incidents, +${pastScore}% risk)`
    );
  }

  if (floodExplanations.length === 0) {
    floodExplanations.push("No rain or flooding incidents reported in this sector.");
  }

  const floodRisk: PredictionFactor = {
    title: "Flood Risk Probability",
    probability: Math.min(100, Math.round(floodProb)),
    explanations: floodExplanations,
  };

  // ==========================================
  // 2. ROAD DAMAGE RISK
  // ==========================================
  let roadProb = 10;
  const roadExplanations: string[] = [];

  // Active road hazard reports (roadblocks, accidents, or others like potholes)
  const activeRoadBlocks = activeLocal.filter(
    (h) => h.category === "roadblock" || h.category === "accident" || h.category === "other"
  ).length;
  if (activeRoadBlocks > 0) {
    const activeScore = Math.min(45, activeRoadBlocks * 15);
    roadProb += activeScore;
    roadExplanations.push(
      `${activeRoadBlocks} active roadway damage/accident reports nearby (+${activeScore}% risk)`
    );
  }

  // Historical road hazards
  const pastRoadBlocks = historicalLocal.filter(
    (h) => h.category === "roadblock" || h.category === "accident" || h.category === "other"
  ).length;
  if (pastRoadBlocks > 0) {
    const pastScore = Math.min(20, pastRoadBlocks * 6);
    roadProb += pastScore;
    roadExplanations.push(
      `Repeated road failures detected historically (${pastRoadBlocks} cases, +${pastScore}% risk)`
    );
  }

  // High wind speeds (creates tree blocks and debris hazards)
  if (weather.windSpeed >= 40) {
    roadProb += 25;
    roadExplanations.push(
      `Severe winds forecast of ${Math.round(weather.windSpeed)} km/h (+25% debris risk)`
    );
  } else if (weather.windSpeed >= 20) {
    roadProb += 10;
    roadExplanations.push(
      `Moderate winds forecast of ${Math.round(weather.windSpeed)} km/h (+10% debris risk)`
    );
  }

  // Heavy rain road erosion
  if (weather.precipitation24h > 15) {
    roadProb += 15;
    roadExplanations.push("Heavy rainfall raises soil erosion and pothole enlargement risk (+15%)");
  }

  if (roadExplanations.length === 0) {
    roadExplanations.push("Road structures in this area are clear of immediate risk factors.");
  }

  const roadDamageRisk: PredictionFactor = {
    title: "Road Damage Risk",
    probability: Math.min(100, Math.round(roadProb)),
    explanations: roadExplanations,
  };

  // ==========================================
  // 3. HAZARD GROWTH RISK
  // ==========================================
  let growthProb = 10;
  const growthExplanations: string[] = [];

  // Density of unresolved local hazards
  const totalActive = activeLocal.length;
  if (totalActive > 0) {
    const densityScore = Math.min(40, totalActive * 10);
    growthProb += densityScore;
    growthExplanations.push(
      `Accumulating unresolved active reports (${totalActive} incidents, +${densityScore}% escalation risk)`
    );
  }

  // Weather triggers (rain or wind driving more report volume)
  if (weather.precipitation24h > 10 || weather.windSpeed > 30) {
    growthProb += 20;
    growthExplanations.push(
      "Unfavorable weather forecast likely to accelerate hazard reports (+20% risk)"
    );
  }

  // Municipal responsiveness backlog: ratio of resolved to total local reports
  const totalLocalCount = localHazards.length;
  if (totalLocalCount > 0) {
    const resolvedRatio = historicalLocal.length / totalLocalCount;
    if (resolvedRatio < 0.3) {
      growthProb += 20;
      growthExplanations.push(
        `Low municipal resolution rate in this sector (${Math.round(
          resolvedRatio * 100
        )}% resolved, +20% backlog risk)`
      );
    }
  }

  if (growthExplanations.length === 0) {
    growthExplanations.push("Sector is exhibiting high resolution speeds and low hazard intake.");
  }

  const hazardGrowthRisk: PredictionFactor = {
    title: "Hazard Growth Risk",
    probability: Math.min(100, Math.round(growthProb)),
    explanations: growthExplanations,
  };

  return {
    weather,
    floodRisk,
    roadDamageRisk,
    hazardGrowthRisk,
  };
};
