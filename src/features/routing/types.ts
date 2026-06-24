export type Coordinate = [number, number]; // [lat, lng]

export type RoutePath = Coordinate[];

export interface ProximityThreat {
  hazardId: string;
  title: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  distanceMeters: number;
  isActive: boolean;
  riskPoints: number;
}

export interface SafetyAnalysisResult {
  safetyScore: number; // 0 to 100
  riskScore: number; // 0 to 100
  proximityThreats: ProximityThreat[];
  explanations: string[];
}

export interface RouteAlternative {
  id: string; // "default" | "detour"
  name: string; // e.g. "Direct Route", "Safety Detour"
  coordinates: RoutePath;
  analysis: SafetyAnalysisResult;
  explanation: string;
}
